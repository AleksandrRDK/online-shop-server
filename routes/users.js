import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import cloudinary from '../cloudinary.js';
import upload from '../middleware/upload.js';
import streamifier from 'streamifier';

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // проверяем, есть ли пользователь с таким email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: 'Такой email уже зарегистрирован' });
        }

        // хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // создаём пользователя
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        res.status(201).json({ message: 'Пользователь создан' });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // ищем пользователя по email
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Неверный email' });

        // проверяем пароль
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: 'Неверный пароль' });

        // генерируем токен
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });
        const isProduction = process.env.NODE_ENV === 'production';
        // ставим токен в HttpOnly куку
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction, // true только на проде
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/logout', (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', '', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 0,
            path: '/',
        });
        res.status(200).json({ message: 'Вы вышли' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/profile', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Нет токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user)
            return res.status(404).json({ message: 'Пользователь не найден' });

        res.json(user);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/profile', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Нет токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { username, email, password } = req.body;

        const updateData = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(decoded.id, updateData, {
            new: true,
        }).select('-password');

        res.json(user);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/profile', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Нет токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user.image) {
            const publicId = user.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
        }

        await User.findByIdAndDelete(decoded.id);

        res.clearCookie('token');
        res.json({ message: 'Аккаунт удален' });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

const streamUpload = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'user_avatars' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

router.put('/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Нет токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!req.file)
            return res.status(400).json({ message: 'Файл не загружен' });

        // Удаляем старый аватар, если есть
        if (user.avatar) {
            const publicId = user.avatar.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
        }

        // Загружаем новый аватар на Cloudinary
        const result = await streamUpload(req.file.buffer);
        user.avatar = result.secure_url;
        await user.save();

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/profile/avatar', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Нет токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (user.image) {
            // достаём public_id из ссылки Cloudinary
            const publicId = user.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
        }

        user.image = undefined;
        await user.save();

        res.json({ message: 'Аватар удалён' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

export default router;

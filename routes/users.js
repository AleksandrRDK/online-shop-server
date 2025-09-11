import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import cloudinary from '../cloudinary.js';
import upload from '../middleware/upload.js';
import streamifier from 'streamifier';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// --- Утилита для загрузки в Cloudinary ---
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

// --- ПРОФИЛЬ ---
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user)
            return res.status(404).json({ message: 'Пользователь не найден' });

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const updateData = {};

        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(req.userId, updateData, {
            new: true,
        }).select('-password');

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (user?.avatar) {
            const publicId = user.avatar.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
        }

        await User.findByIdAndDelete(req.userId);

        res.json({ message: 'Аккаунт удален' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// --- АВАТАР ---
router.put(
    '/profile/avatar',
    authMiddleware,
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ message: 'Файл не загружен' });

            const user = await User.findById(req.userId);

            // удаляем старый аватар
            if (user?.avatar) {
                const publicId = user.avatar.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
            }

            const result = await streamUpload(req.file.buffer);
            user.avatar = result.secure_url;
            await user.save();

            res.json(user);
        } catch (e) {
            console.error(e);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    }
);

router.delete('/profile/avatar', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (user?.avatar) {
            const publicId = user.avatar.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`user_avatars/${publicId}`);
            user.avatar = undefined;
            await user.save();
        }

        res.json({ message: 'Аватар удалён' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import User from '../models/User.js';
import Session from '../models/Session.js';

const router = express.Router();

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_DAYS = 30;

function generateAccessToken(userId, sessionId) {
    return jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, {
        expiresIn: ACCESS_EXPIRES_IN,
    });
}

function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existing = await User.findOne({ email });
        if (existing) {
            return res
                .status(400)
                .json({ message: 'Такой email уже зарегистрирован' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
        });

        // создаём refresh токен
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

        const session = await Session.create({
            userId: user._id,
            refreshTokenHash,
            userAgent: req.get('user-agent'),
            ip: req.ip,
            expiresAt,
        });

        const accessToken = generateAccessToken(user._id, session._id);

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            accessToken,
            user: { id: user._id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Неверный email' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: 'Неверный пароль' });

        // создаем refresh токен
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

        const session = await Session.create({
            userId: user._id,
            refreshTokenHash,
            userAgent: req.get('user-agent'),
            ip: req.ip,
            expiresAt,
        });

        // генерим access
        const accessToken = generateAccessToken(user._id, session._id);

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
        });

        res.json({
            accessToken,
            user: { id: user._id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// REFRESH
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Нет refresh токена' });
        }

        const sessions = await Session.find({
            expiresAt: { $gt: new Date() },
        });

        let foundSession = null;
        for (let session of sessions) {
            const match = await bcrypt.compare(
                refreshToken,
                session.refreshTokenHash
            );
            if (match) {
                foundSession = session;
                break;
            }
        }

        if (!foundSession) {
            return res.status(401).json({ message: 'Неверный refresh токен' });
        }

        const newAccessToken = generateAccessToken(
            foundSession.userId,
            foundSession._id
        );
        res.json({ accessToken: newAccessToken });
    } catch (err) {
        console.error('Ошибка в /refresh:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// LOGOUT
router.post('/logout', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        const { userId } = req.body;

        if (!refreshToken || !userId) {
            return res.status(400).json({ message: 'Нет данных для выхода' });
        }

        // ищем только сессии конкретного пользователя
        const sessions = await Session.find({ userId });

        for (let session of sessions) {
            const match = await bcrypt.compare(
                refreshToken,
                session.refreshTokenHash
            );
            if (match) {
                await session.deleteOne();
                break;
            }
        }
        const isProduction = process.env.NODE_ENV === 'production';

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });

        res.json({ message: 'Вы вышли из системы' });
    } catch (err) {
        console.error('Ошибка в /logout:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

export default router;

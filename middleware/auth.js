import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token)
            return res.status(401).json({ message: 'Нет access токена' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.sessionId = decoded.sessionId;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res
                .status(401)
                .json({ message: 'Access токен истёк', code: 'TOKEN_EXPIRED' });
        }
        return res
            .status(401)
            .json({ message: 'Неверный access токен', code: 'TOKEN_INVALID' });
    }
};

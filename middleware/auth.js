import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res
                .status(401)
                .json({ message: 'Нет доступа, нужен токен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // добавляем user.id в объект запроса
        next();
    } catch (err) {
        res.status(401).json({ message: 'Неверный или просроченный токен' });
    }
};

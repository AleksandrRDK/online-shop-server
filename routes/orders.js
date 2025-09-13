import express from 'express';
import Order from '../models/Order.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/user', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.userId })
            .populate('userId', 'username email')
            .populate('products.productId', 'title price image')
            .sort({ createdAt: -1 });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'Заказы не найдены' });
        }

        res.json(orders);
    } catch (err) {
        console.error('Ошибка получения заказов пользователя:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId)
            .populate('userId', 'username email')
            .populate('products.productId', 'title price image');

        if (!order) {
            return res.status(404).json({ message: 'Заказ не найден' });
        }

        res.json(order);
    } catch (err) {
        console.error('Ошибка получения заказа:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

export default router;

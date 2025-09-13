import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const item = user.cart.find(
            (i) => i.productId.toString() === productId
        );

        if (item) {
            item.quantity += quantity;
        } else {
            user.cart.push({ productId, quantity });
        }

        await user.save();

        await user.populate('cart.productId');

        res.status(201).json(user.cart);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('cart.productId');

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(user.cart);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.delete('/:productId', authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        user.cart = user.cart.filter(
            (item) => item.productId.toString() !== productId
        );

        await user.save();
        await user.populate('cart.productId');

        res.json(user.cart);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

export default router;

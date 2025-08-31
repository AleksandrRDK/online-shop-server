import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { userId, productId, quantity = 1 } = req.body;

        const user = await User.findById(userId);
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

router.delete('/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;

        const user = await User.findById(userId);
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

router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate(
            'cart.productId'
        );

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(user.cart);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

export default router;

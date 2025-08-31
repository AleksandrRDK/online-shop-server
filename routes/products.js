import express from 'express';
import Product from '../models/Product.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            image,
            price,
            tags,
            characteristics,
            ownerId,
        } = req.body;

        const owner = await User.findById(ownerId);
        if (!owner)
            return res.status(404).json({ message: 'Пользователь не найден' });

        const product = new Product({
            title,
            description,
            image,
            price,
            tags,
            characteristics,
            owner: owner._id,
        });

        await product.save();
        res.status(201).json(product);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const products = await Product.find().populate(
            'owner',
            'username email'
        );
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        const products = await Product.find({ owner: req.params.userId });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate(
            'owner',
            'username email'
        );
        if (!product)
            return res.status(404).json({ message: 'Товар не найден' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('owner', 'username email');
        if (!updatedProduct)
            return res.status(404).json({ message: 'Товар не найден' });
        res.json(updatedProduct);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct)
            return res.status(404).json({ message: 'Товар не найден' });
        res.json({ message: 'Товар удалён' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;

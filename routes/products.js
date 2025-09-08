import express from 'express';
import Product from '../models/Product.js';
import User from '../models/User.js';
import cloudinary from '../cloudinary.js';
import upload from '../middleware/upload.js';
import streamifier from 'streamifier';

const router = express.Router();

router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, description, price, tags, characteristics, ownerId } =
            req.body;

        const owner = await User.findById(ownerId);
        if (!owner)
            return res.status(404).json({ message: 'Пользователь не найден' });

        let imageUrl = undefined;
        if (req.file) {
            // Загружаем в Cloudinary
            const streamUpload = (req) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'product_images' },
                        (error, result) => {
                            if (result) resolve(result);
                            else reject(error);
                        }
                    );
                    streamifier.createReadStream(req.file.buffer).pipe(stream);
                });
            };

            const result = await streamUpload(req);
            imageUrl = result.secure_url;
        }

        const product = new Product({
            title,
            description,
            price: Number(price),
            tags: tags ? JSON.parse(tags) : [],
            characteristics: characteristics ? JSON.parse(characteristics) : {},
            owner: owner._id,
            image: imageUrl,
        });

        await product.save();
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 48, filter = 'all', tags } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        let sortOption = {};
        if (filter === 'new') sortOption = { createdAt: -1 };

        let filterQuery = {};
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : tags.split(',');
            filterQuery.tags = { $in: tagsArray };
        }

        const totalItems = await Product.countDocuments(filterQuery);

        const products = await Product.find(filterQuery)
            .populate('owner', 'username email')
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            products,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/tags', async (req, res) => {
    try {
        const tagsWithCount = await Product.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        const formattedTags = tagsWithCount.map((t) => ({
            tag: t._id,
            count: t.count,
        }));

        res.json(formattedTags);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        let { page = 1, limit = 48 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const filter = { owner: req.params.userId };

        const totalItems = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .populate('owner', 'username email')
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            products,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
        });
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

router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product)
            return res.status(404).json({ message: 'Товар не найден' });

        // Если загружен новый файл — обновляем картинку
        if (req.file) {
            // Удаляем старую картинку из Cloudinary
            if (product.image) {
                const publicId = product.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`product_images/${publicId}`);
            }

            const streamUpload = (req) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'product_images' },
                        (error, result) => {
                            if (result) resolve(result);
                            else reject(error);
                        }
                    );
                    streamifier.createReadStream(req.file.buffer).pipe(stream);
                });
            };

            const result = await streamUpload(req);
            product.image = result.secure_url;
        }

        // Обновляем остальные поля
        const { title, description, price, tags, characteristics } = req.body;
        if (title) product.title = title;
        if (description) product.description = description;
        if (price !== undefined) product.price = Number(price);
        if (tags) product.tags = JSON.parse(tags);
        if (characteristics)
            product.characteristics = JSON.parse(characteristics);

        await product.save();
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product)
            return res.status(404).json({ message: 'Товар не найден' });

        if (product.image) {
            const publicId = product.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({ message: 'Товар удалён' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;

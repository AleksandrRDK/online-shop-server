import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import userRoutes from './routes/users.js';
import ProductRoutes from './routes/products.js';
import CartRoutes from './routes/carts.js';

dotenv.config();

const app = express();

app.use(
    cors({
        origin: ['http://localhost:5173', 'https://aleksandrrdk.github.io'],
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('✅ MongoDB connected');
        app.listen(PORT, () =>
            console.log(`🚀 Server running on port ${PORT}`)
        );
    })
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// маршруты
app.get('/', (req, res) => {
    res.send('Сервер работает!');
});
app.use('/api/users', userRoutes);
app.use('/api/products', ProductRoutes);
app.use('/api/carts', CartRoutes);

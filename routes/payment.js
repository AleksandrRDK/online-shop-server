import express from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const YooKassa = new YooCheckout({
    shopId: process.env.YOOKASSA_API_SHOPID,
    secretKey: process.env.YOOKASSA_API_SECRET_KEY,
});

router.post('/create', authMiddleware, async (req, res) => {
    try {
        if (!req.userId)
            return res.status(400).json({ message: 'Требуется userId' });

        // Получаем пользователя и корзину
        const user = await User.findById(req.userId).populate('cart.productId');
        if (!user)
            return res.status(404).json({ message: 'Пользователь не найден' });
        if (!user.cart || user.cart.length === 0)
            return res.status(400).json({ message: 'Корзина пуста' });

        // Считаем итоговую сумму
        const totalPrice = user.cart.reduce(
            (sum, item) =>
                sum + Number(item.productId.price || 0) * item.quantity,
            0
        );

        // 1️⃣ Создаём заказ с временным paymentId, чтобы получить orderId
        const tempPaymentId = uuidv4(); // временный ID
        const order = new Order({
            userId: user._id,
            products: user.cart.map((i) => ({
                productId: i.productId._id,
                quantity: i.quantity,
            })),
            totalPrice,
            status: 'pending',
            paymentId: tempPaymentId,
        });
        await order.save();

        // 2️⃣ Формируем returnUrl с реальным orderId
        const returnUrl = `${process.env.CLIENT_URL}/#/cart/success/${order._id}`;

        // 3️⃣ Создаём платёж в YooKassa
        const paymentPayload = {
            amount: {
                value: totalPrice.toFixed(2),
                currency: 'RUB',
            },
            payment_method_data: { type: 'bank_card' },
            confirmation: { type: 'redirect', return_url: returnUrl },
            capture: true,
            description: `Заказ пользователя ${user.username}`,
            metadata: { orderId: order._id.toString() },
        };

        const payment = await YooKassa.createPayment(paymentPayload, uuidv4());

        // 4️⃣ Обновляем order реальным paymentId
        order.paymentId = payment.id;
        await order.save();

        // 5️⃣ Отдаём фронту confirmationUrl и orderId
        return res.json({
            confirmationUrl: payment.confirmation?.confirmation_url,
            orderId: order._id,
        });
    } catch (err) {
        console.error('payment/create error:', err);
        return res.status(500).json({ message: 'Ошибка при создании платежа' });
    }
});

router.post('/webhook', async (req, res) => {
    try {
        const { event, object } = req.body;

        if (event && event.startsWith('payment')) {
            const paymentId = object.id;

            const order = await Order.findOne({ paymentId });
            if (!order) {
                console.warn('Заказ не найден:', paymentId);
                return res.status(200).send('OK'); // отвечаем OK, чтобы ЮKassa не спамила
            }

            // Обновляем статус заказа
            if (object.status === 'succeeded') {
                order.status = 'succeeded';
                await order.save();

                // Чистим корзину пользователя
                await User.findByIdAndUpdate(order.userId, {
                    $set: { cart: [] },
                });

                console.log('Заказ оплачен:', order._id);
            } else if (object.status === 'canceled') {
                order.status = 'canceled';
                await order.save();
            }

            return res.status(200).send('OK');
        }

        return res.status(200).send('IGNORED');
    } catch (err) {
        console.error('Ошибка webhook:', err);
        return res.status(500).send('Server error');
    }
});

export default router;

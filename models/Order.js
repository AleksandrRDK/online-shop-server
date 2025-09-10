import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                },
                quantity: { type: Number, default: 1 },
            },
        ],
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'succeeded', 'canceled'],
            default: 'pending',
        },
        paymentId: {
            type: String, // ID платежа в ЮKassa
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model('Order', OrderSchema);

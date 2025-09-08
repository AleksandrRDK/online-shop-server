import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        image: { type: String },
        price: { type: Number, required: true, min: 0 },
        tags: { type: [String], default: [] },
        characteristics: { type: Map, of: String },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

const Product = mongoose.model('Product', ProductSchema);
export default Product;

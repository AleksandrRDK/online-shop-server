import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        refreshTokenHash: { type: String, required: true },
        userAgent: String,
        ip: String,
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

// TTL индекс для автоматического удаления
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Дополнительный индекс для быстрого поиска по юзеру и токену
SessionSchema.index({ userId: 1, refreshTokenHash: 1 });

const Session = mongoose.model('Session', SessionSchema);
export default Session;

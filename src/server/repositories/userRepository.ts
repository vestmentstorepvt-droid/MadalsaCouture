// @ts-nocheck — ported from the Express backend (repositories/userRepository.js); logic unchanged.
import __imp0 from "@/server/models/userModel";

const User = __imp0;

class UserRepository {
  async create(data) {
    return User.create(data);
  }

  async findByEmail(email) {
    return User.findOne({ email }).select('+password +refreshToken +refreshTokenExpiresAt +passwordResetToken +passwordResetExpiresAt +verificationToken +verificationTokenExpiresAt');
  }

  async findByPhone(phone) {
    return User.findOne({ phone });
  }

  async findById(id) {
    return User.findById(id).select('+password +refreshToken +refreshTokenExpiresAt +passwordResetToken +passwordResetExpiresAt +verificationToken +verificationTokenExpiresAt');
  }

  async updateById(id, data) {
    return User.findByIdAndUpdate(id, data, { new: true });
  }

  async updateOne(filter, data) {
    return User.findOneAndUpdate(filter, data, { new: true });
  }

  async findOne(filter) {
    return User.findOne(filter);
  }
}

const __exports: any = new UserRepository();

export default __exports;

import * as jwt from 'jsonwebtoken';
import User from '../db/models/user.model';
import config from '../config/config';

export function generateToken(user: User): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(user.jwtRepr(), config.JWT_SECRET!, { algorithm: 'HS256' }, function (err, token) {
      if (err || !token) {
        return reject(err || new Error('Failed to generate token'));
      }
      return resolve(token);
    });
  });
}

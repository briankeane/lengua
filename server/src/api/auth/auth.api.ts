import { NextFunction, Request, Response } from 'express';
import { googleSignIn, login, signup } from '../../lib/auth';

export async function handleSignup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName } = req.body;
    const { user, token } = await signup({
      email,
      password,
      firstName,
      lastName,
    });
    res.status(201).json({ user: user.jwtRepr(), token });
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const { user, token } = await login({ email, password });
    res.status(200).json({ user: user.jwtRepr(), token });
  } catch (err) {
    next(err);
  }
}

export async function handleGoogleSignIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = req.body;
    const { user, token } = await googleSignIn({ idToken });
    res.status(200).json({ user: user.jwtRepr(), token });
  } catch (err) {
    next(err);
  }
}

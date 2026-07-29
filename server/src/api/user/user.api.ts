import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../security';
import { getUser, updateUser } from '../../lib/user';

export async function handleGetMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await getUser(authReq.auth.id);
    res.status(200).json({ user: user.jwtRepr() });
  } catch (err) {
    next(err);
  }
}

export async function handleGetUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getUser(req.params.userId as string);
    res.status(200).json({ user: user.jwtRepr() });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, displayName, profileImageUrl } = req.body;
    const user = await updateUser(req.params.userId as string, {
      firstName,
      lastName,
      displayName,
      profileImageUrl,
    });
    res.status(200).json({ user: user.jwtRepr() });
  } catch (err) {
    next(err);
  }
}

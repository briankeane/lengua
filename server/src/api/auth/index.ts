import express from 'express';
import { checkBodyFor } from '../validation';
import { handleGoogleSignIn, handleLogin, handleSignup } from './auth.api';

const router = express.Router();

router.post('/signup', checkBodyFor(['email', 'password', 'firstName']), handleSignup);

router.post('/login', checkBodyFor(['email', 'password']), handleLogin);

router.post('/google', checkBodyFor(['idToken']), handleGoogleSignIn);

export default router;

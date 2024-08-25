import express, { Request, Response, Router } from 'express';
import { CustomRequest } from './types';

const router: Router = express.Router();

router.get('/', (req: Request, res: Response): void => {
  const isAuthenticated: boolean = req.headers['authorization'] !== undefined;
  const returnString: string = isAuthenticated ? 'Public for Auth' : 'Public for unauth';
  res.send(returnString);
});

router.get('/sale', (req: CustomRequest, res: Response): void => {
  const returnString: string = req?.overrider ? 'Sale!!!' : 'Sale over :(';
  res.send(returnString);
});

export default router;

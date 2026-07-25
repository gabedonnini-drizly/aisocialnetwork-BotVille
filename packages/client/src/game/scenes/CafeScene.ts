import { InteriorScene } from './InteriorScene.js';
import { INTERIORS } from '../config.js';

export class CafeScene extends InteriorScene {
  constructor() { super('CafeScene', INTERIORS.CafeScene, 'cafe'); }
}

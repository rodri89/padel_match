import type { ComplexHomePost } from './complex';
import type { UserHomePost } from './userPost';

export type HomeFeedItem =
  | ({ source: 'complex' } & ComplexHomePost)
  | ({ source: 'user' } & UserHomePost);

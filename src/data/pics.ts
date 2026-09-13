export interface Pic {
  src: string;
  srcset?: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}

// Photos are served from R2 at media.prestonroser.dev. The gallery page and
// the home page strip only show up once this has something in it.
export const pics: Pic[] = [];

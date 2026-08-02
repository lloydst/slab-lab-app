import type { SlabProject } from '@slablab/shared';

export abstract class ProjectRepository {
  abstract load(): SlabProject[];
  abstract save(projects: SlabProject[]): void;
}

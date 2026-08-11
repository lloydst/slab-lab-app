import { Injectable } from '@angular/core';
import type { SlabProject } from '@slablab/shared';
import { ProjectRepository } from './project.repository';

@Injectable({ providedIn: 'root' })
export class LocalProjectRepository implements ProjectRepository {
  private readonly key = 'slablab.projects.v1';

  load(): SlabProject[] {
    try {
      const projects: unknown = JSON.parse(localStorage.getItem(this.key) ?? '[]');
      if (!Array.isArray(projects)) throw new TypeError('Stored projects must be an array');
      return projects as SlabProject[];
    } catch (error) {
      console.error('Could not load stored projects', error);
      return [];
    }
  }

  save(projects: SlabProject[]) {
    localStorage.setItem(this.key, JSON.stringify(projects));
  }
}

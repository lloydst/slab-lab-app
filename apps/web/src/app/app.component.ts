import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DesignWorkspaceComponent } from './features/workspace/design-workspace.component';

@Component({
  selector: 'slab-root',
  standalone: true,
  imports: [DesignWorkspaceComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}

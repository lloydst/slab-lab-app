import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkspaceFormComponent } from './form/workspace-form.component';
import { WorkspaceHeaderComponent } from './header/workspace-header.component';
import { WorkspaceDesignService } from './services/workspace-design.service';
import { WorkspaceUiService } from './services/workspace-ui.service';
import { WorkspaceSidebarComponent } from './sidebar/workspace-sidebar.component';
import { WorkspaceTabsComponent } from './tabs/workspace-tabs.component';

@Component({
  selector: 'slab-design-workspace',
  standalone: true,
  imports: [
    WorkspaceFormComponent,
    WorkspaceHeaderComponent,
    WorkspaceSidebarComponent,
    WorkspaceTabsComponent,
  ],
  templateUrl: './design-workspace.component.html',
  styleUrl: './design-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [WorkspaceDesignService, WorkspaceUiService],
})
export class DesignWorkspaceComponent {
  readonly design = inject(WorkspaceDesignService);
}

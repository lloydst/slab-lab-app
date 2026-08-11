import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { WorkspaceDesignService } from '../services/workspace-design.service';
import { WorkspaceUiService } from '../services/workspace-ui.service';
import { ShapeGlyphComponent } from './shape-glyph.component';

@Component({
  selector: 'slab-workspace-form',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    ShapeGlyphComponent,
  ],
  templateUrl: './workspace-form.component.html',
  styleUrl: './workspace-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceFormComponent {
  readonly design = inject(WorkspaceDesignService);
  readonly store = this.design.store;
  readonly ui = inject(WorkspaceUiService);
}

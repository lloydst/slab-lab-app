import { ComponentHarness } from '@angular/cdk/testing';

export class WorkspaceFormHarness extends ComponentHarness {
  static hostSelector = 'slab-workspace-form';

  private readonly shapeButtons = this.locatorForAll('.shape-grid button');
  private readonly previewButton = this.locatorFor('.mobile-preview');
  private readonly dimensionLabels = this.locatorForAll('.field-grid > label > span');
  private readonly dimensionInputs = this.locatorForAll('.field-grid > label input');

  async selectShape(label: string): Promise<void> {
    const buttons = await this.shapeButtons();
    for (const button of buttons) {
      if ((await button.text()).includes(label)) {
        await button.click();
        return;
      }
    }
    throw new Error(`Could not find shape "${label}".`);
  }

  async showPreview(): Promise<void> {
    await (await this.previewButton()).click();
  }

  async getDimensionLabels(): Promise<string[]> {
    return Promise.all((await this.dimensionLabels()).map(async (label) => (await label.text()).trim()));
  }

  async setDimension(label: string, value: string): Promise<void> {
    const labels = await this.dimensionLabels();
    const inputs = await this.dimensionInputs();
    for (const [index, fieldLabel] of labels.entries()) {
      if ((await fieldLabel.text()).trim() === label) {
        await inputs[index]!.setInputValue(value);
        await inputs[index]!.dispatchEvent('input');
        return;
      }
    }
    throw new Error(`Could not find dimension "${label}".`);
  }

}

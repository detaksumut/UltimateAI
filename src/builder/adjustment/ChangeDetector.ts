// src/builder/adjustment/ChangeDetector.ts

export interface DetectedChange {
  actionType: 'add_screen' | 'change_theme' | 'add_parameter' | 'remove_parameter' | 'change_navigation' | 'unknown';
  target: string;
  value?: any;
}

export class ChangeDetector {
  /**
   * Detects intent from adjustment prompt.
   */
  public detectChanges(adjustmentPrompt: string): DetectedChange[] {
    const changes: DetectedChange[] = [];
    const lower = adjustmentPrompt.toLowerCase();

    if (lower.includes('login') || lower.includes('auth') || lower.includes('signin') || lower.includes('google')) {
      changes.push({ actionType: 'add_screen', target: 'login', value: true });
    }

    if (lower.includes('gis') || lower.includes('map') || lower.includes('peta')) {
      changes.push({ actionType: 'add_screen', target: 'gis-map', value: true });
    }

    if (lower.includes('bottom') || lower.includes('tab')) {
      changes.push({ actionType: 'change_navigation', target: 'type', value: 'tabs' });
    } else if (lower.includes('sidebar') || lower.includes('side')) {
      changes.push({ actionType: 'change_navigation', target: 'type', value: 'sidebar' });
    }

    if (lower.includes('dark')) {
      changes.push({ actionType: 'change_theme', target: 'darkMode', value: true });
    } else if (lower.includes('light')) {
      changes.push({ actionType: 'change_theme', target: 'darkMode', value: false });
    }

    if (lower.includes('color') || lower.includes('theme') || lower.includes('emerald') || lower.includes('red') || lower.includes('blue') || lower.includes('violet')) {
      let color = '#3b82f6'; // default blue
      if (lower.includes('emerald') || lower.includes('green')) color = '#10b981';
      if (lower.includes('violet') || lower.includes('purple')) color = '#8b5cf6';
      if (lower.includes('red') || lower.includes('rose')) color = '#f43f5e';
      if (lower.includes('yellow') || lower.includes('amber')) color = '#f59e0b';
      
      changes.push({ actionType: 'change_theme', target: 'primaryColor', value: color });
    }

    // Detect parameter additions, like "add gps field" or "tambahkan note"
    if (lower.includes('add') || lower.includes('tambah')) {
      if (lower.includes('gps') || lower.includes('lokasi')) {
        changes.push({ actionType: 'add_parameter', target: 'GPS Location', value: { type: 'text', required: false } });
      } else if (lower.includes('photo') || lower.includes('foto') || lower.includes('gambar')) {
        changes.push({ actionType: 'add_parameter', target: 'Photo Capture', value: { type: 'text', required: false } });
      } else if (lower.includes('note') || lower.includes('catatan')) {
        changes.push({ actionType: 'add_parameter', target: 'Notes', value: { type: 'textarea', required: false } });
      } else if (lower.includes('age') || lower.includes('umur')) {
        changes.push({ actionType: 'add_parameter', target: 'Age', value: { type: 'number', required: true } });
      }
    }

    // Detect parameter removals, like "remove phone" or "hapus foto"
    if (lower.includes('remove') || lower.includes('delete') || lower.includes('hapus')) {
      if (lower.includes('photo') || lower.includes('foto')) {
        changes.push({ actionType: 'remove_parameter', target: 'Photo Capture' });
      } else if (lower.includes('gps') || lower.includes('location')) {
        changes.push({ actionType: 'remove_parameter', target: 'GPS Location' });
      }
    }

    if (changes.length === 0) {
      changes.push({ actionType: 'unknown', target: adjustmentPrompt });
    }

    return changes;
  }
}

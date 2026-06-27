// src/builder/prototype/ComponentComposer.ts

import { Parameter } from '../requirement/VariableDetector';

export interface UIComponent {
  id: string;
  type: 'chart' | 'input' | 'button' | 'table' | 'card' | 'navbar' | 'text' | 'form' | 'quick-actions';
  props: Record<string, any>;
}

export class ComponentComposer {
  /**
   * Composes ui elements based on screens and model parameters.
   */
  public composeComponentsForScreen(
    screenId: string,
    screenType: string,
    parameters: Parameter[],
    model?: any
  ): UIComponent[] {
    const components: UIComponent[] = [];

    const title = model?.researchTitle || 'Research Project';
    const depVar = model?.variables?.dependent?.[0] || 'Observations';
    const indVar = model?.variables?.independent?.[0] || 'Observation Date';
    const roleCount = model?.roles?.length || 3;

    const promptText = (title + " " + (model?.researchType || '') + " " + (model?.researchObjectives?.join(" ") || "")).toLowerCase();
    const isEnvironmental = promptText.includes('gis') || promptText.includes('map') || promptText.includes('peta') || promptText.includes('spatial') || promptText.includes('location') || promptText.includes('carbon') || promptText.includes('tax') || promptText.includes('emission') || promptText.includes('temperature') || promptText.includes('biology') || promptText.includes('amphibian') || promptText.includes('embryo') || promptText.includes('soil');
    const isClinical = promptText.includes('medicine') || promptText.includes('clinical') || promptText.includes('patient') || promptText.includes('nursing') || promptText.includes('pharmacy') || promptText.includes('trial') || promptText.includes('health') || promptText.includes('hospital');
    const isEditorial = promptText.includes('journal') || promptText.includes('editor') || promptText.includes('author') || promptText.includes('publication') || promptText.includes('article') || promptText.includes('review');
    const isFinance = promptText.includes('accounting') || promptText.includes('management') || promptText.includes('economics') || promptText.includes('finance') || promptText.includes('wage') || promptText.includes('salary') || promptText.includes('audit');

    if (screenType === 'dashboard') {
      // 1. Project Overview Card
      components.push({
        id: 'project-overview',
        type: 'card',
        props: {
          title: title,
          description: model?.intent?.objective || `Central platform to observe and log metrics for this ${model?.researchType || 'research'} study.`
        }
      });

      if (isEnvironmental) {
        // Map-first Dashboard
        components.push({
          id: 'map-preview',
          type: 'card',
          props: {
            isMap: true,
            coordinates: 'GPS Grid Active: 12 observation logs',
            locationsCount: 'Map Center: Lat -6.208, Lng 106.84'
          }
        });
        components.push({
          id: 'summary-cards',
          type: 'card',
          props: {
            items: [
              { label: 'Logged Points', value: '184', color: 'blue' },
              { label: 'Active Sensors', value: '12', color: 'emerald' },
              { label: 'Avg Value', value: '36.4°C', color: 'violet' }
            ]
          }
        });
        components.push({
          id: 'quick-actions',
          type: 'quick-actions',
          props: {
            actions: [
              { label: 'Start Survey', screenId: 'data-form' },
              { label: 'Open GIS Map', screenId: 'gis-map' },
              { label: 'Reports Hub', screenId: 'reports' }
            ]
          }
        });
      } else if (isClinical) {
        // Patient-first Dashboard
        components.push({
          id: 'summary-cards',
          type: 'card',
          props: {
            items: [
              { label: 'Enrolled Subjects', value: '48 registered', color: 'blue' },
              { label: 'Pending Labs', value: '8 reports', color: 'emerald' },
              { label: 'Clinical Phase', value: 'Phase II', color: 'violet' }
            ]
          }
        });
        components.push({
          id: 'recent-activity',
          type: 'card',
          props: {
            title: 'Active Patient Activity Log',
            description: '• Patient #104 observation logged by Dr. Allison\n• Clinical telemetry check sync completed successfully\n• Lab alerts dispatched for Subject #082'
          }
        });
        components.push({
          id: 'quick-actions',
          type: 'quick-actions',
          props: {
            actions: [
              { label: 'Register Patient', screenId: 'data-form' },
              { label: 'Browse Patients', screenId: 'data-list' },
              { label: 'System Settings', screenId: 'settings' }
            ]
          }
        });
      } else if (isEditorial) {
        // Submission-first Dashboard
        components.push({
          id: 'summary-cards',
          type: 'card',
          props: {
            items: [
              { label: 'Pending Queues', value: '14 articles', color: 'blue' },
              { label: 'Assigned Reviewers', value: '28 reviews', color: 'emerald' },
              { label: 'Published DOIs', value: '42 issues', color: 'violet' }
            ]
          }
        });
        components.push({
          id: 'trend-chart',
          type: 'chart',
          props: {
            title: 'Submissions Trend Chart',
            chartType: 'line',
            data: [
              { label: 'Month 1', value: 3 },
              { label: 'Month 2', value: 8 },
              { label: 'Month 3', value: 12 },
              { label: 'Month 4', value: 19 },
              { label: 'Month 5', value: 27 }
            ]
          }
        });
        components.push({
          id: 'quick-actions',
          type: 'quick-actions',
          props: {
            actions: [
              { label: 'Submit Article', screenId: 'data-form' },
              { label: 'Editorial Desk', screenId: 'data-list' },
              { label: 'Reports Hub', screenId: 'reports' }
            ]
          }
        });
      } else if (isFinance) {
        // Charts-first Dashboard
        components.push({
          id: 'trend-chart-1',
          type: 'chart',
          props: {
            title: 'Comparative Wage Outliers Trend',
            chartType: 'line',
            data: [
              { label: 'Q1', value: 5 },
              { label: 'Q2', value: 12 },
              { label: 'Q3', value: 18 },
              { label: 'Q4', value: 24 }
            ]
          }
        });
        components.push({
          id: 'summary-cards',
          type: 'card',
          props: {
            items: [
              { label: 'Audited Units', value: '124', color: 'blue' },
              { label: 'Average Wage', value: '$4,850/mo', color: 'emerald' },
              { label: 'Active Roles', value: roleCount.toString(), color: 'violet' }
            ]
          }
        });
        components.push({
          id: 'quick-actions',
          type: 'quick-actions',
          props: {
            actions: [
              { label: 'Log Transaction', screenId: 'data-form' },
              { label: 'Finance Sheets', screenId: 'data-list' },
              { label: 'Statistical Analysis', screenId: 'analysis' }
            ]
          }
        });
      } else {
        // Fallback General Dashboard
        components.push({
          id: 'summary-cards',
          type: 'card',
          props: {
            items: [
              { label: `Total ${depVar.split(' ')[0]}`, value: '48', color: 'blue' },
              { label: `Avg ${indVar.split(' ')[0] || 'Value'}`, value: '14.2', color: 'emerald' },
              { label: 'System Roles', value: roleCount.toString(), color: 'violet' }
            ]
          }
        });
        components.push({
          id: 'trend-chart',
          type: 'chart',
          props: {
            title: `${depVar} vs ${indVar}`,
            chartType: 'line',
            data: [
              { label: 'Week 1', value: 3 },
              { label: 'Week 2', value: 6 },
              { label: 'Week 3', value: 9 },
              { label: 'Week 4', value: 14 },
              { label: 'Week 5', value: 19 }
            ]
          }
        });
        components.push({
          id: 'quick-actions',
          type: 'quick-actions',
          props: {
            actions: [
              { label: 'Data Entry Form', screenId: 'data-form' },
              { label: 'Observations Grid', screenId: 'data-list' },
              { label: 'Reports Hub', screenId: 'reports' }
            ]
          }
        });
      }
    } else if (screenType === 'form') {
      // Recommends form inputs corresponding to each parameter
      parameters.forEach((p, idx) => {
        components.push({
          id: `input-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
          type: 'input',
          props: {
            label: p.name,
            inputType: p.type,
            required: p.required,
            options: p.options || [],
            placeholder: `Enter ${p.name.toLowerCase()}...`
          }
        });
      });

      // Submit button
      components.push({
        id: 'submit-btn',
        type: 'button',
        props: {
          label: 'Submit Record',
          variant: 'primary'
        }
      });
    } else if (screenType === 'list') {
      // Recommends a search bar and observations table
      components.push({
        id: 'search-bar',
        type: 'input',
        props: {
          label: 'Search observations',
          inputType: 'text',
          placeholder: 'Filter observations...'
        }
      });

      components.push({
        id: 'obs-table',
        type: 'table',
        props: {
          headers: parameters.map(p => p.name),
          rows: [
            parameters.map((p) => {
              if (p.type === 'number') return '12.5';
              if (p.type === 'date') return '2026-06-27';
              if (p.type === 'checkbox') return 'True';
              return 'Sample Data';
            })
          ]
        }
      });
    } else if (screenType === 'report') {
      components.push({
        id: 'exporter-card',
        type: 'card',
        props: {
          title: `${title} - Export Options`,
          description: 'Download structured research outputs directly.'
        }
      });
      components.push({
        id: 'export-pdf-btn',
        type: 'button',
        props: {
          label: 'Export PDF Report',
          variant: 'indigo'
        }
      });
      components.push({
        id: 'export-csv-btn',
        type: 'button',
        props: {
          label: 'Export CSV Spreadsheet',
          variant: 'outline'
        }
      });
    } else if (screenType === 'settings') {
      components.push({
        id: 'profile-card',
        type: 'card',
        props: {
          title: 'User Profile & API Sync',
          description: 'Manage Supabase DB synchronization state.'
        }
      });
      components.push({
        id: 'sync-toggle',
        type: 'input',
        props: {
          label: 'Enable Supabase Cloud Sync',
          inputType: 'checkbox',
          checked: true
        }
      });
    } else if (screenType === 'login') {
      components.push({
        id: 'login-title',
        type: 'card',
        props: {
          title: `Welcome to ${title}`,
          description: 'Authenticate to access secure data pipelines.'
        }
      });
      components.push({
        id: 'input-username',
        type: 'input',
        props: {
          label: 'Email Address',
          inputType: 'email',
          required: true,
          placeholder: 'researcher@domain.com'
        }
      });
      components.push({
        id: 'input-password',
        type: 'input',
        props: {
          label: 'Security Key / Password',
          inputType: 'password',
          required: true,
          placeholder: '••••••••'
        }
      });
      components.push({
        id: 'google-login-btn',
        type: 'button',
        props: {
          label: 'Sign in with Google Account',
          variant: 'outline'
        }
      });
      components.push({
        id: 'login-btn',
        type: 'button',
        props: {
          label: 'Sign In Securely',
          variant: 'primary'
        }
      });
    } else if (screenType === 'map' || screenType === 'gis-map') {
      components.push({
        id: 'map-card',
        type: 'card',
        props: {
          title: `${depVar} - Geo-Spatial Mapping`,
          description: `Visual mapping plot of ${depVar.toLowerCase()} observations.`
        }
      });
      components.push({
        id: 'map-widget',
        type: 'card',
        props: {
          isMap: true,
          coordinates: 'Lat: -6.2088, Lng: 106.8456',
          locationsCount: '18 points logged'
        }
      });
    } else if (screenType === 'analysis') {
      components.push({
        id: 'anova-card',
        type: 'card',
        props: {
          title: `ANOVA: ${depVar} over ${indVar}`,
          description: 'R-Squared / ANOVA outputs for parameters.'
        }
      });
      components.push({
        id: 'stats-table',
        type: 'table',
        props: {
          headers: ['Factor', 'R-Square', 'F-Value', 'P-Value'],
          rows: [
            [indVar, '0.842', '15.42', '< 0.001']
          ]
        }
      });
    }

    return components;
  }
}

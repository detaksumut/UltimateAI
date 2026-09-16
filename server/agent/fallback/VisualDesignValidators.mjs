/**
 * VisualDesignValidators.mjs
 * Validation suite for JIN.VisualDesignSpec v1.0 specifications.
 * 
 * Pipeline:
 * Hermes -> JSON.parse() -> SchemaValidator -> GeometryValidator -> SafetyValidator -> Renderer
 */

export class SchemaValidator {
  static validate(spec, domain) {
    if (!spec || typeof spec !== 'object') {
      return { valid: false, error: 'Spec must be a non-null object' };
    }

    if (spec.schema !== 'JIN.VisualDesignSpec') {
      return { valid: false, error: `Invalid schema: expected JIN.VisualDesignSpec, got "${spec.schema}"` };
    }

    if (spec.version !== '1.0') {
      return { valid: false, error: `Invalid version: expected 1.0, got "${spec.version}"` };
    }

    const expectedDomain = domain || spec.domain;
    if (spec.domain !== expectedDomain) {
      return { valid: false, error: `Domain mismatch: expected ${expectedDomain}, got "${spec.domain}"` };
    }

    if (!spec.requestId || typeof spec.requestId !== 'string') {
      return { valid: false, error: 'Missing or invalid requestId' };
    }

    if (!spec.canvas || typeof spec.canvas !== 'object') {
      return { valid: false, error: 'Missing canvas definition' };
    }

    if (typeof spec.canvas.width !== 'number' || spec.canvas.width <= 0 ||
        typeof spec.canvas.height !== 'number' || spec.canvas.height <= 0) {
      return { valid: false, error: 'Invalid canvas dimensions' };
    }

    if (spec.domain === 'PRESENTATION') {
      if (!spec.background || typeof spec.background !== 'object') {
        return { valid: false, error: 'PRESENTATION spec requires background object' };
      }
      if (!spec.theme || typeof spec.theme !== 'object') {
        return { valid: false, error: 'PRESENTATION spec requires theme object' };
      }
      if (!spec.header || typeof spec.header !== 'object' || typeof spec.header.title !== 'string') {
        return { valid: false, error: 'PRESENTATION spec requires header with title string' };
      }
      if (!Array.isArray(spec.elements)) {
        return { valid: false, error: 'PRESENTATION spec requires elements array' };
      }
    } else if (spec.domain === 'HOUSE_DESIGN') {
      if (!spec.site || typeof spec.site !== 'object') {
        return { valid: false, error: 'HOUSE_DESIGN spec requires site dimensions' };
      }
      if (!spec.building || typeof spec.building !== 'object') {
        return { valid: false, error: 'HOUSE_DESIGN spec requires building definition' };
      }
      if (!spec.facade || typeof spec.facade !== 'object') {
        return { valid: false, error: 'HOUSE_DESIGN spec requires facade definition' };
      }
      if (!Array.isArray(spec.spaces)) {
        return { valid: false, error: 'HOUSE_DESIGN spec requires spaces array' };
      }
    } else {
      return { valid: false, error: `Unsupported domain: "${spec.domain}". Must be PRESENTATION or HOUSE_DESIGN.` };
    }

    return { valid: true };
  }
}

export class GeometryValidator {
  static validate(spec) {
    if (!spec || !spec.canvas) {
      return { valid: false, error: 'Missing canvas for geometry validation' };
    }

    const { width: cW, height: cH } = spec.canvas;

    if (spec.domain === 'PRESENTATION') {
      for (const el of spec.elements || []) {
        if (!el.id || !el.type) {
          return { valid: false, error: `Element missing id or type: ${JSON.stringify(el)}` };
        }

        if (typeof el.x !== 'number' || typeof el.y !== 'number') {
          return { valid: false, error: `Element ${el.id} missing x/y coordinate numbers` };
        }

        // Allow some elements like icons or labels without full width/height
        const elW = el.width || el.size || 0;
        const elH = el.height || el.size || 0;

        if (el.x < 0 || el.y < 0 || (el.x + elW > cW * 1.05) || (el.y + elH > cH * 1.05)) {
          return {
            valid: false,
            error: `Element ${el.id} exceeds canvas bounds [${cW}x${cH}]: x=${el.x}, y=${el.y}, w=${elW}, h=${elH}`
          };
        }
      }
    } else if (spec.domain === 'HOUSE_DESIGN') {
      const site = spec.site || {};
      const bldg = spec.building || {};
      const footprint = bldg.footprint || {};

      if (site.widthMeters && site.depthMeters) {
        if (site.widthMeters <= 0 || site.depthMeters <= 0) {
          return { valid: false, error: 'Site dimensions must be positive' };
        }
      }

      if (footprint.widthMeters && footprint.depthMeters) {
        if (site.widthMeters && footprint.widthMeters > site.widthMeters) {
          return { valid: false, error: `Building footprint width (${footprint.widthMeters}m) exceeds site width (${site.widthMeters}m)` };
        }
        if (site.depthMeters && footprint.depthMeters > site.depthMeters) {
          return { valid: false, error: `Building footprint depth (${footprint.depthMeters}m) exceeds site depth (${site.depthMeters}m)` };
        }
      }
    }

    return { valid: true };
  }
}

export class SafetyValidator {
  static validate(spec) {
    const raw = JSON.stringify(spec).toLowerCase();

    // STRICT INVARIANT: ZERO POLLINATIONS
    if (raw.includes('pollinations') || raw.includes('pollinations.ai')) {
      return { valid: false, error: 'POLLINATIONS_FORBIDDEN: Spec contains reference to pollinations' };
    }

    // No dangerous script tags or injection strings
    if (raw.includes('<script') || raw.includes('javascript:') || raw.includes('onerror=')) {
      return { valid: false, error: 'SAFETY_VIOLATION: Spec contains prohibited script syntax' };
    }

    return { valid: true };
  }
}

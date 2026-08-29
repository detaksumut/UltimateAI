/**
 * IncidentQueue.mjs
 * Thread-safe, persistent, priority-based Incident Queue with deduplication and debouncing.
 */

import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { IncidentSeverity, IncidentStatus } from '../types/IncidentTypes.mjs';

const STORAGE_PATH = path.resolve(process.cwd(), '.system', 'incidents.json');

export class IncidentQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.listeners = new Set();
    this.ensureStorage();
    this.loadFromDisk();
  }

  ensureStorage() {
    const dir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
        this.queue = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[IncidentQueue] Failed to load stored incidents, initializing empty queue:', e.message);
      this.queue = [];
    }
  }

  saveToDisk() {
    try {
      this.ensureStorage();
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(this.queue.slice(-200), null, 2), 'utf8');
    } catch (e) {
      console.error('[IncidentQueue] Error saving to disk:', e.message);
    }
  }

  enqueue(ticket) {
    if (!ticket || !ticket.errorMessage) return null;

    // Deduplicate recent identical incidents within 10 seconds
    const existing = this.queue.find(item =>
      item.targetComponent === ticket.targetComponent &&
      item.errorMessage === ticket.errorMessage &&
      (item.status === IncidentStatus.DETECTED || item.status === IncidentStatus.DIAGNOSING) &&
      (Date.now() - new Date(item.updatedAt).getTime()) < 15000
    );

    if (existing) {
      existing.frequency += 1;
      existing.updatedAt = new Date().toISOString();
      if (ticket.metadata) {
        existing.metadata = { ...existing.metadata, ...ticket.metadata };
      }
      this.saveToDisk();
      this.emit('incident_updated', existing);
      return existing;
    }

    // Insert new ticket and sort by severity
    this.queue.unshift(ticket);
    this.saveToDisk();
    this.emit('incident_enqueued', ticket);
    return ticket;
  }

  updateStatus(incidentId, status, extraData = {}) {
    const item = this.queue.find(i => i.incidentId === incidentId);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();
      Object.assign(item, extraData);
      this.saveToDisk();
      this.emit('incident_updated', item);
      return item;
    }
    return null;
  }

  getPendingIncidents() {
    return this.queue.filter(i =>
      i.status === IncidentStatus.DETECTED ||
      i.status === IncidentStatus.DIAGNOSING ||
      i.status === IncidentStatus.AWAITING_APPROVAL
    );
  }

  getAllIncidents() {
    return [...this.queue];
  }

  getIncidentById(incidentId) {
    return this.queue.find(i => i.incidentId === incidentId);
  }
}

export const incidentQueueInstance = new IncidentQueue();

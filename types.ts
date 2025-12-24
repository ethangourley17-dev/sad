
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
export type CallStatus = 'Pending' | 'In Progress' | 'Appointment Set' | 'Rejected' | 'Follow Up';
export type ViewType = 'Dashboard' | 'Leads' | 'Funnels' | 'Analytics';

export interface VoiceConfig {
  voiceName: VoiceName;
  speed: number;
  pitch: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  status: CallStatus;
  notes: string;
  source: string; // Funnel ID or 'Manual'
}

export interface Funnel {
  id: string;
  name: string;
  niche: string;
  html: string;
  magnetismScore: number;
  targetKeywords: string[];
}

export interface Campaign {
  id: string;
  name: string;
  model: string;
  systemInstruction: string;
  objectionHandling: string;
  script: string;
  voice: VoiceConfig;
  leads: Lead[];
  funnels: Funnel[];
  stats: {
    totalCalls: number;
    appointments: number;
    conversion: number;
  };
}

export interface AppState {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  currentView: ViewType;
}

export interface Artifact {
  id: string;
  styleName: string;
  status: 'streaming' | 'complete';
  html: string;
}

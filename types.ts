export enum AppState {
  SETUP = 'SETUP',
  PERSONA_SELECTION = 'PERSONA_SELECTION',
  CALLING = 'CALLING',
  EVALUATION = 'EVALUATION',
  HISTORY = 'HISTORY'
}

export enum CallMode {
  TEXT = 'TEXT',
  VOICE = 'VOICE'
}

export interface ProductContext {
  url: string;
  companyName: string;
  description: string;
  sellingPoints: string[];
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  companySize: string;
  industry: string;
  motivation: string;
  painPoints: string;
  communicationStyle: string;
  difficulty: number; // 1-5
  avatarColor: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface EvaluationMetrics {
  openingScore: number;
  discoveryScore: number;
  pitchScore: number;
  objectionHandlingScore: number;
  closingScore: number;
  totalScore: number;
  goodPoints: string[];
  improvementPoints: string[];
  nextSteps: string[];
}

export interface SessionHistory {
  id: string;
  date: string;
  persona: Persona;
  product: ProductContext;
  evaluation: EvaluationMetrics;
  transcript: ChatMessage[];
}
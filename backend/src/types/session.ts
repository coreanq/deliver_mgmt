import 'express-session';
import type { SolapiTokens, SolapiAccountInfo, SolapiSender } from '../services/solapiAuth';

declare module 'express-session' {
  interface SessionData {
    googleTokens?: {
      accessToken: string;
      refreshToken: string;
      connectedAt?: string;
    };
    solapiTokens?: SolapiTokens;
    solapiAccountInfo?: SolapiAccountInfo;
    solapiSenders?: SolapiSender[];
    solapiState?: string;
    connectedSpreadsheet?: {
      id: string;
      sheets: Array<{ sheetId: number; title: string }>;
    };
    deliveryAuth?: {
      staffName: string;
      authenticatedAt: string;
    };
  }
}
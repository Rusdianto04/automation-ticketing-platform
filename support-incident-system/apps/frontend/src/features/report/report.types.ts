/**
 * features/report/report.types.ts
 */

export interface IncidentReport {
  id:             number;
  ticket_id:      number;
  report_title:   string;
  file_url:       string | null;
  file_path:      string | null;
  report_type:    string;
  generated_by:   string;
  generated_at:   string;
}

export interface GenerateReportPayload {
  ticketId:     number;
  reportType?:  string;
  generatedBy?: string;
}

export interface IncidentStats {
  total:        number;
  open:         number;
  investigating: number;
  mitigating:   number;
  resolved:     number;
  last24h:      number;
}

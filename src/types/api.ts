// API response and request types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode: number;
  details?: Array<{ field: string; message: string }>;
}

// Common request params
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface DateRangeParams {
  start_date: string;
  end_date: string;
}

// Dashboard stats
export interface DashboardStats {
  total_leads: number;
  total_applications: number;
  total_disbursed: number;
  total_commission: number;
  conversion_rate: number;
  monthly_target: number;
  monthly_achieved: number;
}

// EMI calculation
export interface EMIResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  principal: number;
  rate: number;
  tenure: number;
}

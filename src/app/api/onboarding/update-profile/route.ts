export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Get current onboarding record
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Calculate profile completion percentage
    const totalFields = 10; // Total important fields
    let completedFields = 2; // first_name, last_name are already filled by HR

    if (validatedData.phone) completedFields++;
    if (validatedData.date_of_birth) completedFields++;
    if (validatedData.gender) completedFields++;
    if (validatedData.address) completedFields++;
    if (validatedData.city) completedFields++;
    if (validatedData.state) completedFields++;
    if (validatedData.pincode) completedFields++;
    if (validatedData.emergency_contact_name && validatedData.emergency_contact_phone) {
      completedFields++;
    }

    const profileCompletionPercentage = Math.round((completedFields / totalFields) * 100);

    // Update onboarding record
    const { data: updated, error: updateError } = await supabase
      .from('employee_onboarding')
      .update({
        ...validatedData,
        profile_completion_percentage: profileCompletionPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating profile', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

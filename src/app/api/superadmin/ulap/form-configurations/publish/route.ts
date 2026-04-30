import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Publish a form configuration
export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      id: z.string().uuid(),

      updated_by: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { id, updated_by } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    // Get the configuration
    const { data: config, error: fetchError } = await supabase
      .from('ulap_form_configurations')
      .select(`
        id,
        category_id,
        loan_type_id,
        profile_id,
        sub_profile_id,
        status,
        version
      `)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (config.status === 'published') {
      return NextResponse.json(
        { error: 'Configuration is already published' },
        { status: 400 }
      );
    }

    // Archive any existing published configuration for the same combination
    await supabase
      .from('ulap_form_configurations')
      .update({ status: 'archived' })
      .eq('category_id', config.category_id)
      .eq('loan_type_id', config.loan_type_id)
      .eq('profile_id', config.profile_id)
      .eq('sub_profile_id', config.sub_profile_id)
      .eq('status', 'published')
      .neq('id', id);

    // Publish the configuration
    const { data: publishedConfig, error: publishError } = await supabase
      .from('ulap_form_configurations')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_by,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (publishError) {
      apiLogger.error('Error publishing form configuration', publishError);
      return NextResponse.json(
        { error: 'Failed to publish form configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      configuration: publishedConfig,
      message: 'Configuration published successfully',
    });
  } catch (error) {
    apiLogger.error('Error in publish form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Unpublish (revert to draft) a form configuration
export async function PUT(request: NextRequest) {
  try {
    const bodySchema2 = z.object({

      updated_by: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { id, updated_by } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    const { data: config, error } = await supabase
      .from('ulap_form_configurations')
      .update({
        status: 'draft',
        updated_by,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error unpublishing form configuration', error);
      return NextResponse.json(
        { error: 'Failed to unpublish form configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      configuration: config,
      message: 'Configuration reverted to draft',
    });
  } catch (error) {
    apiLogger.error('Error in unpublish form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

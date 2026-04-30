import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Duplicate a form configuration
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      id: z.string().uuid(),

      new_name: z.string().optional(),

      target_category_id: z.string().uuid().optional(),

      target_loan_type_id: z.string().uuid().optional(),

      target_profile_id: z.string().uuid().optional(),

      target_sub_profile_id: z.string().uuid().optional(),

      created_by: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { id, new_name, target_category_id, target_loan_type_id, target_profile_id, target_sub_profile_id, created_by } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Source configuration ID is required' },
        { status: 400 }
      );
    }

    // Get the source configuration with tabs and fields
    const { data: sourceConfig, error: fetchError } = await supabase
      .from('ulap_form_configurations')
      .select(`
        id,
        name,
        description,
        category_id,
        loan_type_id,
        profile_id,
        sub_profile_id,
        ulap_form_configuration_tabs (
          id,
          tab_key,
          label,
          icon,
          description,
          display_order,
          is_visible,
          is_required,
          ulap_form_configuration_fields (
            id,
            field_key,
            field_type,
            label,
            placeholder,
            helper_text,
            default_value,
            column_span,
            display_order,
            is_required,
            validation_rules,
            options,
            conditional_logic,
            field_config,
            is_visible,
            is_read_only
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !sourceConfig) {
      return NextResponse.json(
        { error: 'Source configuration not found' },
        { status: 404 }
      );
    }

    // Create the new configuration
    const { data: newConfig, error: createError } = await supabase
      .from('ulap_form_configurations')
      .insert({
        name: new_name || `${sourceConfig.name} (Copy)`,
        description: sourceConfig.description,
        category_id: target_category_id || sourceConfig.category_id,
        loan_type_id: target_loan_type_id || sourceConfig.loan_type_id,
        profile_id: target_profile_id || sourceConfig.profile_id,
        sub_profile_id: target_sub_profile_id || sourceConfig.sub_profile_id,
        status: 'draft',
        version: 1,
        is_default: false,
        created_by,
      })
      .select()
      .maybeSingle();

    if (createError) {
      apiLogger.error('Error creating duplicate configuration', createError);
      return NextResponse.json(
        { error: 'Failed to create duplicate configuration' },
        { status: 500 }
      );
    }

    // Duplicate tabs
    const sourceTabs = sourceConfig.ulap_form_configuration_tabs || [];
    if (sourceTabs.length > 0) {
      const tabsToInsert = sourceTabs.map(tab => ({
        form_configuration_id: newConfig.id,
        tab_key: tab.tab_key,
        label: tab.label,
        icon: tab.icon,
        description: tab.description,
        display_order: tab.display_order,
        is_visible: tab.is_visible,
        is_required: tab.is_required,
      }));

      const { data: newTabs, error: tabsError } = await supabase
        .from('ulap_form_configuration_tabs')
        .insert(tabsToInsert)
        .select();

      if (tabsError) {
        apiLogger.error('Error duplicating tabs', tabsError);
        // Clean up
        await supabase.from('ulap_form_configurations').delete().eq('id', newConfig.id);
        return NextResponse.json(
          { error: 'Failed to duplicate tabs' },
          { status: 500 }
        );
      }

      // Create tab mapping (old tab_key -> new tab_id)
      const tabMapping: Record<string, string> = {};
      newTabs?.forEach(tab => {
        tabMapping[tab.tab_key] = tab.id;
      });

      // Duplicate fields
      const fieldsToInsert: Array<Record<string, unknown>> = [];
      sourceTabs.forEach(tab => {
        const fields = tab.ulap_form_configuration_fields || [];
        const newTabId = tabMapping[tab.tab_key];
        if (newTabId && fields.length > 0) {
          fields.forEach(field => {
            fieldsToInsert.push({
              form_configuration_id: newConfig.id,
              tab_id: newTabId,
              field_key: field.field_key,
              field_type: field.field_type,
              label: field.label,
              placeholder: field.placeholder,
              helper_text: field.helper_text,
              default_value: field.default_value,
              column_span: field.column_span,
              display_order: field.display_order,
              is_required: field.is_required,
              validation_rules: field.validation_rules,
              options: field.options,
              conditional_logic: field.conditional_logic,
              field_config: field.field_config,
              is_visible: field.is_visible,
              is_read_only: field.is_read_only,
            });
          });
        }
      });

      if (fieldsToInsert.length > 0) {
        const { error: fieldsError } = await supabase
          .from('ulap_form_configuration_fields')
          .insert(fieldsToInsert);

        if (fieldsError) {
          apiLogger.error('Error duplicating fields', fieldsError);
          // Clean up
          await supabase.from('ulap_form_configurations').delete().eq('id', newConfig.id);
          return NextResponse.json(
            { error: 'Failed to duplicate fields' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      configuration: newConfig,
      message: 'Configuration duplicated successfully',
    }, { status: 201 });
  } catch (error) {
    apiLogger.error('Error in duplicate form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

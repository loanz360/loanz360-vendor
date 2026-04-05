export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch form configuration(s)
// Can be used to:
// 1. Get all published configurations
// 2. Get configuration by 4-key combination (category_id + loan_type_id + profile_id + sub_profile_id)
// 3. Get configuration by id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const categoryId = searchParams.get('category_id');
    const loanTypeId = searchParams.get('loan_type_id');
    const profileId = searchParams.get('profile_id');
    const subProfileId = searchParams.get('sub_profile_id');
    const includeFields = searchParams.get('include_fields') !== 'false';

    // Resolve by 4-key combination
    if (categoryId && loanTypeId && profileId && subProfileId) {
      const { data: config, error } = await supabase
        .from('ulap_form_configurations')
        .select(includeFields ? `
          id,
          name,
          description,
          category_id,
          loan_type_id,
          profile_id,
          sub_profile_id,
          status,
          version,
          is_default,
          created_at,
          updated_at,
          published_at,
          ulap_loan_categories (id, name, icon, color),
          ulap_loan_subcategories (id, name, code),
          ulap_applicant_profiles (id, key, name),
          ulap_applicant_sub_profiles (id, key, name),
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
        ` : `
          id,
          name,
          description,
          category_id,
          loan_type_id,
          profile_id,
          sub_profile_id,
          status,
          version,
          is_default,
          created_at,
          updated_at,
          published_at
        `)
        .eq('category_id', categoryId)
        .eq('loan_type_id', loanTypeId)
        .eq('profile_id', profileId)
        .eq('sub_profile_id', subProfileId)
        .eq('status', 'published')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        apiLogger.error('Error fetching form configuration', error);
        return NextResponse.json(
          { error: 'Failed to fetch form configuration' },
          { status: 500 }
        );
      }

      if (!config) {
        return NextResponse.json(
          { error: 'No published form configuration found for this combination' },
          { status: 404 }
        );
      }

      // Transform response
      const transformedConfig = transformConfiguration(config);

      return NextResponse.json({
        success: true,
        configuration: transformedConfig,
      });
    }

    // Get by ID
    if (id) {
      const { data: config, error } = await supabase
        .from('ulap_form_configurations')
        .select(includeFields ? `
          id,
          name,
          description,
          category_id,
          loan_type_id,
          profile_id,
          sub_profile_id,
          status,
          version,
          is_default,
          created_at,
          updated_at,
          published_at,
          ulap_loan_categories (id, name, icon, color),
          ulap_loan_subcategories (id, name, code),
          ulap_applicant_profiles (id, key, name),
          ulap_applicant_sub_profiles (id, key, name),
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
        ` : `
          id,
          name,
          description,
          category_id,
          loan_type_id,
          profile_id,
          sub_profile_id,
          status,
          version,
          is_default,
          created_at,
          updated_at,
          published_at
        `)
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (error) {
        apiLogger.error('Error fetching form configuration', error);
        return NextResponse.json(
          { error: 'Failed to fetch form configuration' },
          { status: 500 }
        );
      }

      const transformedConfig = transformConfiguration(config);

      return NextResponse.json({
        success: true,
        configuration: transformedConfig,
      });
    }

    // Get all published configurations
    const { data: configs, error } = await supabase
      .from('ulap_form_configurations')
      .select(`
        id,
        name,
        description,
        category_id,
        loan_type_id,
        profile_id,
        sub_profile_id,
        status,
        version,
        is_default,
        created_at,
        updated_at,
        published_at,
        ulap_loan_categories (id, name, icon, color),
        ulap_loan_subcategories (id, name, code),
        ulap_applicant_profiles (id, key, name),
        ulap_applicant_sub_profiles (id, key, name)
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      apiLogger.error('Error fetching form configurations', error);
      return NextResponse.json(
        { error: 'Failed to fetch form configurations' },
        { status: 500 }
      );
    }

    const transformedConfigs = configs?.map(transformConfiguration) || [];

    return NextResponse.json({
      success: true,
      configurations: transformedConfigs,
      count: transformedConfigs.length,
    });
  } catch (error) {
    apiLogger.error('Error in form configurations API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to transform configuration response
function transformConfiguration(config: Record<string, unknown>) {
  if (!config) return null;

  const transformed: Record<string, unknown> = {
    id: config.id,
    name: config.name,
    description: config.description,
    category_id: config.category_id,
    loan_type_id: config.loan_type_id,
    profile_id: config.profile_id,
    sub_profile_id: config.sub_profile_id,
    status: config.status,
    version: config.version,
    is_default: config.is_default,
    created_at: config.created_at,
    updated_at: config.updated_at,
    published_at: config.published_at,
  };

  // Add category info
  if (config.ulap_loan_categories) {
    const cat = config.ulap_loan_categories as Record<string, unknown>;
    transformed.category_name = cat.name;
    transformed.category_icon = cat.icon;
    transformed.category_color = cat.color;
  }

  // Add loan type info
  if (config.ulap_loan_subcategories) {
    const lt = config.ulap_loan_subcategories as Record<string, unknown>;
    transformed.loan_type_name = lt.name;
    transformed.loan_type_code = lt.code;
  }

  // Add profile info
  if (config.ulap_applicant_profiles) {
    const prof = config.ulap_applicant_profiles as Record<string, unknown>;
    transformed.profile_name = prof.name;
    transformed.profile_key = prof.key;
  }

  // Add sub-profile info
  if (config.ulap_applicant_sub_profiles) {
    const subProf = config.ulap_applicant_sub_profiles as Record<string, unknown>;
    transformed.sub_profile_name = subProf.name;
    transformed.sub_profile_key = subProf.key;
  }

  // Transform tabs and fields if present
  if (config.ulap_form_configuration_tabs) {
    const tabs = config.ulap_form_configuration_tabs as Array<Record<string, unknown>>;
    transformed.tabs = tabs
      .sort((a, b) => (a.display_order as number) - (b.display_order as number))
      .map(tab => ({
        id: tab.id,
        key: tab.tab_key,
        label: tab.label,
        icon: tab.icon,
        description: tab.description,
        display_order: tab.display_order,
        is_visible: tab.is_visible,
        is_required: tab.is_required,
      }));

    // Build fields record keyed by tab_key
    const fieldsRecord: Record<string, unknown[]> = {};
    tabs.forEach(tab => {
      const fields = tab.ulap_form_configuration_fields as Array<Record<string, unknown>> | undefined;
      if (fields) {
        fieldsRecord[tab.tab_key as string] = fields
          .sort((a, b) => (a.display_order as number) - (b.display_order as number))
          .map(field => ({
            id: field.id,
            key: field.field_key,
            type: field.field_type,
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
          }));
      }
    });
    transformed.fields = fieldsRecord;
  }

  return transformed;
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all form configurations (including drafts) for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'draft', 'published', 'archived', or null for all
    const categoryId = searchParams.get('category_id');
    const includeFields = searchParams.get('include_fields') === 'true';

    let query = supabase
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
        created_by,
        updated_by,
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
          is_required
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
        created_by,
        updated_by,
        created_at,
        updated_at,
        published_at,
        ulap_loan_categories (id, name, icon, color),
        ulap_loan_subcategories (id, name, code),
        ulap_applicant_profiles (id, key, name),
        ulap_applicant_sub_profiles (id, key, name)
      `)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: configs, error } = await query;

    if (error) {
      apiLogger.error('Error fetching form configurations', error);
      return NextResponse.json(
        { error: 'Failed to fetch form configurations' },
        { status: 500 }
      );
    }

    // Transform configurations
    const transformedConfigs = configs?.map(config => ({
      id: config.id,
      name: config.name,
      description: config.description,
      category_id: config.category_id,
      category_name: (config.ulap_loan_categories as { name?: string })?.name,
      loan_type_id: config.loan_type_id,
      loan_type_name: (config.ulap_loan_subcategories as { name?: string })?.name,
      profile_id: config.profile_id,
      profile_name: (config.ulap_applicant_profiles as { name?: string })?.name,
      sub_profile_id: config.sub_profile_id,
      sub_profile_name: (config.ulap_applicant_sub_profiles as { name?: string })?.name,
      status: config.status,
      version: config.version,
      is_default: config.is_default,
      tabs: config.ulap_form_configuration_tabs || [],
      created_at: config.created_at,
      updated_at: config.updated_at,
      published_at: config.published_at,
    })) || [];

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

// POST - Create a new form configuration with tabs and fields
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category_id,
      loan_type_id,
      profile_id,
      sub_profile_id,
      tabs,
      fields,
      is_default,
      created_by,
    } = body;

    // Validate required fields
    if (!category_id || !loan_type_id || !profile_id || !sub_profile_id) {
      return NextResponse.json(
        { error: 'Category, loan type, profile, and sub-profile IDs are required' },
        { status: 400 }
      );
    }

    // Create configuration
    const { data: config, error: configError } = await supabase
      .from('ulap_form_configurations')
      .insert({
        name: name || 'Untitled Configuration',
        description,
        category_id,
        loan_type_id,
        profile_id,
        sub_profile_id,
        status: 'draft',
        version: 1,
        is_default: is_default || false,
        created_by,
      })
      .select()
      .maybeSingle();

    if (configError) {
      apiLogger.error('Error creating form configuration', configError);
      return NextResponse.json(
        { error: 'Failed to create form configuration' },
        { status: 500 }
      );
    }

    // Create tabs if provided
    if (tabs && Array.isArray(tabs) && tabs.length > 0) {
      const tabsToInsert = tabs.map((tab, index) => ({
        form_configuration_id: config.id,
        tab_key: tab.key || tab.tab_key,
        label: tab.label,
        icon: tab.icon,
        description: tab.description,
        display_order: tab.display_order ?? index,
        is_visible: tab.is_visible !== false,
        is_required: tab.is_required || false,
      }));

      const { data: insertedTabs, error: tabsError } = await supabase
        .from('ulap_form_configuration_tabs')
        .insert(tabsToInsert)
        .select();

      if (tabsError) {
        apiLogger.error('Error creating form tabs', tabsError);
        // Clean up: delete the configuration
        await supabase.from('ulap_form_configurations').delete().eq('id', config.id);
        return NextResponse.json(
          { error: 'Failed to create form tabs' },
          { status: 500 }
        );
      }

      // Create fields if provided
      if (fields && typeof fields === 'object') {
        const fieldsToInsert: Array<Record<string, unknown>> = [];

        for (const tab of insertedTabs || []) {
          const tabFields = fields[tab.tab_key];
          if (tabFields && Array.isArray(tabFields)) {
            tabFields.forEach((field, index) => {
              fieldsToInsert.push({
                form_configuration_id: config.id,
                tab_id: tab.id,
                field_key: field.key || field.field_key,
                field_type: field.type || field.field_type,
                label: field.label,
                placeholder: field.placeholder,
                helper_text: field.helper_text,
                default_value: field.default_value,
                column_span: field.column_span || 1,
                display_order: field.display_order ?? index,
                is_required: field.is_required || false,
                validation_rules: field.validation_rules || {},
                options: field.options || [],
                conditional_logic: field.conditional_logic || {},
                field_config: field.field_config || {},
                is_visible: field.is_visible !== false,
                is_read_only: field.is_read_only || false,
              });
            });
          }
        }

        if (fieldsToInsert.length > 0) {
          const { error: fieldsError } = await supabase
            .from('ulap_form_configuration_fields')
            .insert(fieldsToInsert);

          if (fieldsError) {
            apiLogger.error('Error creating form fields', fieldsError);
            // Clean up
            await supabase.from('ulap_form_configurations').delete().eq('id', config.id);
            return NextResponse.json(
              { error: 'Failed to create form fields' },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      configuration: config,
    }, { status: 201 });
  } catch (error) {
    apiLogger.error('Error in create form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a form configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      tabs,
      fields,
      is_default,
      updated_by,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    // Get current configuration
    const { data: currentConfig, error: fetchError } = await supabase
      .from('ulap_form_configurations')
      .select('id, status, version')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !currentConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Update configuration
    const updateData: Record<string, unknown> = { updated_by };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_default !== undefined) updateData.is_default = is_default;

    const { data: config, error: updateError } = await supabase
      .from('ulap_form_configurations')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating form configuration', updateError);
      return NextResponse.json(
        { error: 'Failed to update form configuration' },
        { status: 500 }
      );
    }

    // Update tabs if provided
    if (tabs && Array.isArray(tabs)) {
      // Delete existing tabs (will cascade delete fields)
      await supabase
        .from('ulap_form_configuration_tabs')
        .delete()
        .eq('form_configuration_id', id);

      // Insert new tabs
      const tabsToInsert = tabs.map((tab, index) => ({
        form_configuration_id: id,
        tab_key: tab.key || tab.tab_key,
        label: tab.label,
        icon: tab.icon,
        description: tab.description,
        display_order: tab.display_order ?? index,
        is_visible: tab.is_visible !== false,
        is_required: tab.is_required || false,
      }));

      const { data: insertedTabs, error: tabsError } = await supabase
        .from('ulap_form_configuration_tabs')
        .insert(tabsToInsert)
        .select();

      if (tabsError) {
        apiLogger.error('Error updating form tabs', tabsError);
        return NextResponse.json(
          { error: 'Failed to update form tabs' },
          { status: 500 }
        );
      }

      // Insert new fields if provided
      if (fields && typeof fields === 'object') {
        const fieldsToInsert: Array<Record<string, unknown>> = [];

        for (const tab of insertedTabs || []) {
          const tabFields = fields[tab.tab_key];
          if (tabFields && Array.isArray(tabFields)) {
            tabFields.forEach((field, index) => {
              fieldsToInsert.push({
                form_configuration_id: id,
                tab_id: tab.id,
                field_key: field.key || field.field_key,
                field_type: field.type || field.field_type,
                label: field.label,
                placeholder: field.placeholder,
                helper_text: field.helper_text,
                default_value: field.default_value,
                column_span: field.column_span || 1,
                display_order: field.display_order ?? index,
                is_required: field.is_required || false,
                validation_rules: field.validation_rules || {},
                options: field.options || [],
                conditional_logic: field.conditional_logic || {},
                field_config: field.field_config || {},
                is_visible: field.is_visible !== false,
                is_read_only: field.is_read_only || false,
              });
            });
          }
        }

        if (fieldsToInsert.length > 0) {
          const { error: fieldsError } = await supabase
            .from('ulap_form_configuration_fields')
            .insert(fieldsToInsert);

          if (fieldsError) {
            apiLogger.error('Error updating form fields', fieldsError);
            return NextResponse.json(
              { error: 'Failed to update form fields' },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      configuration: config,
    });
  } catch (error) {
    apiLogger.error('Error in update form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete or archive a form configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    if (hardDelete) {
      const { error } = await supabase
        .from('ulap_form_configurations')
        .delete()
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deleting form configuration', error);
        return NextResponse.json(
          { error: 'Failed to delete form configuration' },
          { status: 500 }
        );
      }
    } else {
      // Archive instead of delete
      const { error } = await supabase
        .from('ulap_form_configurations')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) {
        apiLogger.error('Error archiving form configuration', error);
        return NextResponse.json(
          { error: 'Failed to archive form configuration' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Configuration deleted' : 'Configuration archived',
    });
  } catch (error) {
    apiLogger.error('Error in delete form configuration API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

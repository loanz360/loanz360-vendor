/**
 * Auto CAM Generator - CAE Bridge
 *
 * When a CRO lead converts to a deal, this bridges the CRM deal
 * into the existing Credit Appraiser Engine (CAE) system by:
 *
 * 1. Calling the bridge_crm_deal_to_partner_lead() RPC function
 *    which creates a partner_leads record from the CRM deal data
 * 2. Optionally triggering CAM generation via the existing CAE API
 *
 * The BDE can then view and enhance the CAM through the existing
 * CAE dashboard (/superadmin/cae-dashboard).
 *
 * Runs fire-and-forget after convert-to-deal succeeds.
 */

interface BridgeParams {
  dealId: string
  croUserId: string
  bdeUserId?: string
  authCookie: string
  baseUrl: string
}

/**
 * Bridge a CRM deal to the existing CAE system.
 * Creates a partner_leads record and optionally triggers CAM generation.
 */
export async function bridgeDealToCAE({
  dealId,
  croUserId,
  bdeUserId,
  authCookie,
  baseUrl,
}: BridgeParams): Promise<{ partnerLeadId: string | null; error?: string }> {
  try {
    // Step 1: Call the bridge RPC function to create partner_leads record
    const bridgeResponse = await fetch(`${baseUrl}/api/ai-crm/cro/bridge-to-cae`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        deal_id: dealId,
        cro_user_id: croUserId,
      }),
    })

    if (!bridgeResponse.ok) {
      const errorText = await bridgeResponse.text()
      console.error('CAE bridge failed:', errorText)
      return { partnerLeadId: null, error: errorText }
    }

    const bridgeResult = await bridgeResponse.json()

    if (!bridgeResult.success) {
      console.error('CAE bridge error:', bridgeResult.error)
      return { partnerLeadId: null, error: bridgeResult.error }
    }

    const partnerLeadId = bridgeResult.data?.partner_lead_id

    // Step 2: Optionally trigger CAM generation (BDE can also do this manually)
    // Only trigger if we have a partner_lead_id and BDE is assigned
    if (partnerLeadId && bdeUserId) {
      // Fire-and-forget CAM generation - BDE will see it in their CAE dashboard
      fetch(`${baseUrl}/api/cae/cam/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie,
        },
        body: JSON.stringify({
          lead_id: partnerLeadId,
          use_universal_cam: true,
          auto_assign: true,
        }),
      }).catch((err) => {
        // CAM generation is optional - BDE can trigger it manually
        console.warn('Auto CAM generation skipped:', err.message)
      })
    }

    return { partnerLeadId }
  } catch (error) {
    console.error('Error bridging deal to CAE:', error)
    return { partnerLeadId: null, error: String(error) }
  }
}

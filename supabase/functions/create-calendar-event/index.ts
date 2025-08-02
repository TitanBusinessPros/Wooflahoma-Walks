import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting booking process...')
    console.log('Method:', req.method)
    console.log('Headers:', Object.fromEntries(req.headers.entries()))
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    let bookingData;
    try {
      bookingData = await req.json()
      console.log('📝 Received booking data:', JSON.stringify(bookingData, null, 2))
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate required fields
    const required = ['ownerName', 'phone', 'email', 'address', 'dogName', 'dogBreed', 'service', 'duration']
    const missing = required.filter(field => !bookingData[field])
    
    if (missing.length > 0) {
      console.error('❌ Missing required fields:', missing)
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('💾 Attempting to save to database...')
    
    // Convert duration to number
    const duration = parseInt(bookingData.duration) || 1
    const pricePerHour = parseFloat(bookingData.pricePerHour) || 25
    const totalAmount = duration * pricePerHour
    
    // Create datetime string for database
    let scheduledDateTime = null
    if (bookingData.bookingDate && bookingData.bookingTime) {
      scheduledDateTime = `${bookingData.bookingDate}T${bookingData.bookingTime}:00`
      console.log('📅 Scheduled datetime:', scheduledDateTime)
    }
    
    const insertData = {
      owner_name: bookingData.ownerName,
      phone: bookingData.phone,
      email: bookingData.email,
      address: bookingData.address || '',
      dog_name: bookingData.dogName,
      dog_breed: bookingData.dogBreed,
      service_type: bookingData.service,
      duration_hours: duration,
      total_amount: totalAmount,
      scheduled_datetime: scheduledDateTime,
      google_event_id: null,
      status: 'pending'
    }
    
    console.log('📋 Insert data:', JSON.stringify(insertData, null, 2))
    
    // Save booking to database
    const { data, error } = await supabaseClient
      .from('bookings')
      .insert([insertData])
      .select()

    if (error) {
      console.error('❌ Database error details:', JSON.stringify(error, null, 2))
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save booking to database',
          details: error.message,
          hint: error.hint || null,
          code: error.code || null
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Booking saved successfully:', data[0])

    // Try to create Google Calendar event (non-blocking)
    try {
      console.log('📅 Attempting Google Calendar integration...')
      
      const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
      const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')
      
      if (serviceAccountEmail && privateKey && scheduledDateTime) {
        console.log('🔑 Google credentials found, creating calendar event...')
        // Google Calendar integration would go here
        // For now, just log that we have the credentials
        console.log('📝 Calendar event creation skipped (not fully implemented)')
      } else {
        console.log('⚠️ Google Calendar credentials not configured or missing datetime')
      }
    } catch (calendarError) {
      console.error('⚠️ Calendar creation failed (non-blocking):', calendarError)
      // Don't fail the booking if calendar fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Booking created successfully! We will contact you to confirm your appointment.',
        booking: data[0]
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Something went wrong while processing your booking. Please try again.',
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000'
})

describe('listPlans', () => {
  it('GETs /api/plans', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })
    const { listPlans } = await import('../api')
    await listPlans()
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/plans',
      expect.objectContaining({ method: 'GET' })
    )
  })
})

describe('generatePlan', () => {
  it('POSTs to /api/plans/generate', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, plan: {} }) })
    const { generatePlan } = await import('../api')
    const profile = {
      goal: 'build_muscle', gym_days: 'Mon,Wed,Fri', rest_days: 'Tue,Thu,Sat,Sun',
      meal_prep_day: 'Sun', fitness_level: 'intermediate', equipment: 'dumbbells',
      dietary_preference: 'none', allergies: 'none', daily_calorie_target: 2800, protein_target_g: 180,
    }
    await generatePlan(profile)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/plans/generate',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('postChat', () => {
  it('POSTs to /api/chat with messages and profile', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Hi', ready: false }) })
    const { postChat } = await import('../api')
    await postChat([{ role: 'user', content: 'Hello' }], {})
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

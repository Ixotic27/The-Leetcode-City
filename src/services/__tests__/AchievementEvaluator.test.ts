import { AchievementEvaluatorService } from "../AchievementEvaluatorService";

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpsert = jest.fn();
const mockInsert = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    upsert: mockUpsert,
    insert: mockInsert,
  })),
};

jest.mock("../config/supabase", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

describe("AchievementEvaluatorService Supabase Pipeline Testing Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockImplementation(() => ({ eq: mockEq }));
    mockEq.mockImplementation(() => ({ single: mockSingle }));
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("should successfully trigger a new achievement award when threshold is reached", async () => {
    mockSingle.mockResolvedValue({
      data: { developer_id: "dev_99", contributions: 15, repositories: 1, stars: 0 },
      error: null,
    });
    mockEq.mockImplementation((col, val) => {
      if (col === "developer_id") {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      return { single: mockSingle };
    });

    await AchievementEvaluatorService.evaluateProgress("dev_99");

    expect(mockSupabase.from).toHaveBeenCalledWith("developer_achievements");
    expect(mockUpsert).toHaveBeenCalled();
  });
});

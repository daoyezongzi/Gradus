import { describe, expect, it } from 'vitest';
import { categories, creditSum, curriculum, initialCourseIds, progress } from './curriculum';
import { initialState, stateSchema } from './store';

describe('培养计划与课表', () => {
  it('课表包含 11 门唯一课程，共 26 学分', () => {
    expect(new Set(initialCourseIds).size).toBe(11);
    expect(initialCourseIds.every(id => curriculum.some(c => c.id === id))).toBe(true);
    expect(creditSum(curriculum.filter(c => initialCourseIds.includes(c.id)))).toBe(26);
  });
  it('必修课程明细与培养计划要求一致', () => {
    for (const category of categories.filter(c => c.mandatory)) expect(creditSum(curriculum.filter(c => c.category === category.id))).toBe(category.required);
    expect(new Set(curriculum.map(c => c.id)).size).toBe(curriculum.length);
  });
  it('体质训练保留 0.25 学分，第二课堂单独统计', () => {
    const result = progress(curriculum, ['G213007', 'G213008', 'X813002', 'X810002']);
    expect(result.graduation).toBe(0.5);
    expect(result.byCategory.second).toBe(1);
    expect(result.byCategory.prerequisite).toBe(2);
  });
  it('重复学期修读记录不会重复累计毕业学分', () => {
    expect(progress(curriculum, ['G134177', 'G134177']).graduation).toBe(3);
  });
  it('初始学期不会自动计入已修学分', () => {
    const state = initialState();
    expect(stateSchema.parse(state).folders).toHaveLength(11);
    expect(progress(state.courses, state.completed).graduation).toBe(0);
  });
});

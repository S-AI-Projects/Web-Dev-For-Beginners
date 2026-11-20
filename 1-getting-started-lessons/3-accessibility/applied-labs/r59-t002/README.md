# Applied Lab R59-T002: Dependency-Plan Validation and Topological Ordering

**Curriculum Topic:** 1-getting-started-lessons/3-accessibility  
**Student:** Vedika Yadav (URN: `e26b07f0785`)

---

## 1. Overview and Lesson Alignment

In web accessibility engineering, remediation and testing tasks frequently depend on prerequisite artifacts:
1. Document structure and landmark regions (`header`, `main`, `nav`) must be structured before testing landmark navigation.
2. Form input labels and error containers must be established before attaching ARIA live region announcements.
3. Color palette contrast audits must be validated before finalizing focus ring styles.

Executing tasks out of order leads to false positives and runtime errors. This lab provides an offline deterministic dependency-plan validator and topological sorter based on Kahn's algorithm.

---

## 2. Fixtures and Boundary Decisions

| Fixture Name | Plan Structure | Classification | Expected Decision & Result |
| :--- | :--- | :--- | :--- |
| `standard_linear` | `A: []`, `B: [A]`, `C: [B]` | Smallest normal multi-step plan | Ordered: `['A', 'B', 'C']` |
| `boundary_empty` | `{}` | Smallest boundary case (zero tasks) | Valid; returns `[]` without error |
| `boundary_single` | `A: []` | Smallest valid plan (single independent task) | Valid; returns `['A']` |
| `boundary_self_cycle` | `A: [A]` | Boundary invalid (self-referential loop) | Rejected with `CircularDependencyError` |
| `cyclic_two_node` | `A: [B]`, `B: [A]` | Invalid mutual cycle | Rejected with `CircularDependencyError` |
| `unknown_dependency` | `A: []`, `B: [A]`, `C: ['NON_EXISTENT_TASK']` | Invalid missing reference | Rejected with `MissingDependencyError`, reporting `'NON_EXISTENT_TASK'` |
| `multiple_independent` | `TaskZ: []`, `TaskA: []`, `TaskM: []` | Disconnected independent nodes | Deterministically ordered alphabetically: `['TaskA', 'TaskM', 'TaskZ']` |

### Boundary Decision Rationale
1. **Empty Plan (`{}`)**: In continuous integration or filtering pipelines, a plan may contain zero relevant tasks. Rejecting empty plans causes fragile pipeline failures; therefore, `{}` is handled gracefully as a valid empty ordering `[]`.
2. **Determinism on Independent Nodes**: When multiple tasks have zero unresolved dependencies, sorting by task ID eliminates execution non-determinism across platforms and environments.
3. **Explicit Missing Identifier Reporting**: When an unknown dependency is encountered, `MissingDependencyError` explicitly carries the missing identifier and the referring task ID to enable immediate debugging.

---

## 3. Automated Check Execution

Run the test suite using standard Python unittest:

```bash
python3 -m unittest discover -s 1-getting-started-lessons/3-accessibility/applied-labs/r59-t002 -p "test_*.py" -v
```

---

## 4. Scope and Limitations

- **Standard Library Only**: Implemented using pure Python 3 primitives (`dict`, `set`, `list`), requiring no third-party packages or package managers.
- **Deterministic Offline Execution**: Uses local fixed fixtures without any external network, cloud provider, or hardware dependencies.
- **Structural Sequencing Only**: Verifies prerequisite execution order; actual DOM accessibility auditing is performed by browser testing engines.

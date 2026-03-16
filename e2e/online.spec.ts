import { test, expect } from '@playwright/test' 

test('Deve validar o título da página', async ({ page }) => {
  await page.goto('http://localhost:5173/') 

  // Checkpoint
  await expect(page).toHaveTitle(/Velô by Alexandre QA Engineer/) 
}) 
import { test, expect } from '@playwright/test'

// AAA - Arrange, Act, Assert

test('Deve consultar um pedido aprovado', async ({ page }) => {
  // Arrange
  await page.goto('http://localhost:5173/') 
  await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint') 
  await page.getByRole('link', { name: 'Consultar Pedido' }).click() 

  // Act
  await page.getByTestId('search-order-id').click() 
  await page.getByTestId('search-order-id').fill('VLO-MVK05A') 
  await page.getByTestId('search-order-button').click() 

  // Assert
  await expect(page.getByTestId('order-result-id')).toBeVisible() 
  await expect(page.getByTestId('order-result-id')).toContainText('VLO-MVK05A') 

  await expect(page.getByTestId('order-result-status')).toBeVisible()  
  await expect(page.getByTestId('order-result-status')).toContainText('APROVADO')  

}) 
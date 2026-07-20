# Torsion Pendulum Instructions: GENERAL PHYSICS WITH CALCULUS (PH_212_400_U2026)

- Course: PHY-212
- Source surface: linked_detail
- Requested URL: https://canvas.oregonstate.edu/courses/2053526/pages/torsion-pendulum-instructions
- Resolved URL: https://canvas.oregonstate.edu/courses/2053526/pages/torsion-pendulum-instructions
- Captured: 2026-07-18T06:49:03.823Z
- Canvas object: page torsion-pendulum-instructions
- Redirected: no

## Headings
- H1: Torsion Pendulum Instructions
- H2: Install phyphox
- H2: Set up the torsion pendulum
- H2: Suspending the phone
- H2: Set up phyphox for measurement
- H2: Perform the measurement
- H2: Data Analysis: Extracting the Damping Factor from Gyroscope Data
- H4: Import and plot the data
- H4: Identify the time step (sampling increment)
- H4: Visually estimate the location of maxima
- H4: Locate the data index (row number) for each maximum
- H4: Find the maximum angular velocity value
- H4: Find the corresponding time for each maximum
- H4: Create a peak-amplitude dataset and plot amplitude vs time

## Visible Text
Torsion Pendulum Instructions

In this experiment, you will construct a torsion pendulum using a smartphone suspended by a string. Unlike a simple pendulum, which swings back and forth under the influence of gravity, a torsion pendulum oscillates by twisting about a vertical axis. The restoring torque is provided by the twisting of the string, which causes the system to undergo rotational oscillations. You will use the smartphone’s built-in gyroscope and the phyphox app to measure the angular velocity of the oscillating system over time. From this data, you will analyze how the amplitude of the motion decreases due to damping and determine the damping constant.

Install phyphox

On your smartphone, open the App Store (iOS) or Google Play Store (Android).
Search for phyphox.
Download and install the app (free).
Open phyphox and allow permission to access the phone’s motion sensors when prompted.

 

Set up the torsion pendulum

Your phone must be securely suspended so it can rotate freely about a vertical axis without swinging back and forth like a normal pendulum.

Securing the phone (One effective method: string suspension harness (not the only acceptable method)):

 

Use string to tie the phone on all four sides, like wrapping a ribbon around a present.
The phone should be held firmly so it cannot slip or rotate independently of the strings.
Gather the strings at the top edge of the phone.
Use a second string to tie these together, forming a single suspension point.

 

Securing the phone (Alternative method: cardboard phone holder (not the only acceptable method):

Another effective (but not required) way to secure the phone is to build a cardboard phone holder that keeps the phone rigid while allowing access to the screen and sensors.
Cut pieces of sturdy cardboard (e.g., shipping box cardboard) to form a snug sleeve that fully encloses the sides and bottom of the phone.
Cut an opening in the front so the phone screen remains visible and accessible.
Ensure the phone fits tightly inside the cardboard holder so it cannot slide or rotate independently.
Tape the cardboard pieces together securely using packing tape or duct tape.
Attach string to the cardboard holder at two or more symmetric points near the top edge of the phone.
Gather these strings and tie them together to form a single suspension point.
Hang the phone so it can rotate freely about the vertical axis without swinging significantly side-to-side.

 

Suspending the phone
Hang your phone with a string from a fixed support (command hook, rod, doorway, etc.).
The phone should:
Hang vertically or horizontally
Be free to rotate (twist) about the vertical axis
Not swing side-to-side significantly

 

Set up phyphox for measurement
Open phyphox.
Select Gyroscope (or “Gyroscope – raw” if multiple options appear).
You will see three angular velocity channels (x, y, z), measured in rad/s.
Place the phone at rest and observe which axis changes when you gently twist the phone.
The correct axis is the one with the largest response during rotation.
You will analyze this axis later.

 

Perform the measurement
Rotate the phone slowly through a couple of revolutions to wind up the torsion pendulum.
Do not pull downward or introduce swinging motion.
Hold the phone stationary in the twisted position.
In phyphox on Gyroscope, press Start to begin recording.
Gently release the phone without pushing it.
Allow the phone to oscillate freely. Oscillations for the runs may take more than 3 minutes.
Press Stop once sufficient data are collected (i.e. enough maxima of oscillations are gathered to fit for the damping factor).
Export the data in an Excel or CSV file for later analysis. It can be sent to your outlook email account.

Figure 1. Performing and exporting a torsion pendulum measurement using phyphox.
(a) Example gyroscope data showing angular velocity versus time for the x, y, and z axes during a torsion pendulum oscillation. (b) Accessing the menu to export the recorded data. (c) Selecting a file format (e.g., Excel or CSV) to export the data for later analysis.

 

Data Analysis: Extracting the Damping Factor from Gyroscope Data
Import and plot the data

Open the exported CSV or Excel file from phyphox.
Identify the column corresponding to time (s).
Identify the gyroscope axis that shows the largest oscillation.
For example, if your pendulum primarily rotated about the y-axis, use the gyroscope y (rad/s) column.
Create a scatter or line plot of: Angular velocity (rad/s) vs time (s).
You should see a damped sinusoidal signal whose amplitude decreases over time.

 

Identify the time step (sampling increment)
To correctly locate maxima in the data, you need to know the time spacing between data points.
Select two adjacent time values in the time column.
Compute the difference: . This value is your time increment.

You will use this to estimate the data row corresponding to a chosen time.

 

Visually estimate the location of maxima
Inspect your plot and identify the peaks (maxima) of the oscillation.
Use one of the following methods to estimate the time of each peak:
Hover your mouse over the plotted point to read the time.
Read the approximate time from the x-axis.
Record the approximate time  for each maximum.

 

Locate the data index (row number) for each maximum

To find the exact maximum value numerically:

Use your estimated peak time 
Compute the approximate data row: row index 
Add a small buffer (± a few rows) to ensure the true maximum is included.

Example: If   = 0.01 sec and  12.3 sec, then: row = 1230. You might search up to row 1240.

 

Find the maximum angular velocity value
Use Excel’s MAX() function on the gyroscope axis column over the selected row range.
Each maximum should be found using MAX() over a limited row range that contains only one peak (for example, =MAX(B2505:B5000)).
Record the maximum angular velocity value:
Visually confirm that this value corresponds to a peak on your plotted graph.

This step ensures the numerical maximum matches the physical oscillation.

 

Find the corresponding time for each maximum

To associate each peak with a time:

Use CTRL+F (Find) in Excel.
Search for the numerical value of
Identify the row where it appears.
Record the corresponding time value from the time column.
Repeat this process for each maximum.

 

Create a peak-amplitude dataset and plot amplitude vs time

Construct a new table with two columns:
Time of peak (s)
Peak angular velocity magnitude (rad/s)
Create a scatter plot of your  vs time

## Links

## Iframes
- Error -> about:blank
- post_message_forwarding -> https://sso.canvaslms.com/post_message_forwarding?rev=e6aca5e55d-9c856c93fa625037&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJwYXJlbnRfZG9tYWluIjoiY2FudmFzLm9yZWdvbnN0YXRlLmVkdSJ9.Y_7TbGBrESilECMiEp8IL9n-40gHDCjKBtRp1VeImmjwp-ey16yj9FLfLrLzGYInjx8U6Ow5IRBeWFd9i9f6Kg

## Buttons

## Hidden Text

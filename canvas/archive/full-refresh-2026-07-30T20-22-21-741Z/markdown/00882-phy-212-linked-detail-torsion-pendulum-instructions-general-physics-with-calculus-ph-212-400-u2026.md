# Torsion Pendulum Instructions: GENERAL PHYSICS WITH CALCULUS (PH_212_400_U2026)

- Course: PHY-212
- Source surface: linked_detail
- Requested URL: https://canvas.oregonstate.edu/courses/2053526/pages/torsion-pendulum-instructions
- Resolved URL: https://canvas.oregonstate.edu/courses/2053526/pages/torsion-pendulum-instructions
- Captured: 2026-07-30T21:01:54.022Z
- Canvas object: page torsion-pendulum-instructions
- Redirected: no

## Headings
- H1: Torsion Pendulum Instructions
- H2: Install phyphox
- H2: Set up the torsion pendulum
- H2: Suspending the phone
- H2: Set up phyphox for measurement
- H2: Perform the measurement
- H2: Data Analysis: Extracting the Damping Factor and Frequency from Gyroscope Data
- H4: Import and plot the data
- H4: Extract the Damping Coefficient and Frequency
- H2: Experimental Tip: Changing Surface Area While Keeping Mass Constant

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

 

Data Analysis: Extracting the Damping Factor and Frequency from Gyroscope Data
Import and plot the data

Open the exported CSV or Excel file from phyphox.
Identify the column corresponding to time (s).
Identify the gyroscope axis that shows the largest oscillation.
For example, if your pendulum primarily rotated about the y-axis, use the gyroscope y (rad/s) column.
Open Vernier graphical analysis Pro version
Links to an external site.
 (license key: gaTFp6hnZq) in your browser. From the home screen, under New Experiment select Manual Entry.
At any point during your analysis, you can save your experiment as a .gambl file. This allows you to reopen the experiment later and continue where you left off or share the file with your group members so they can view or continue the analysis
Locate the empty data table on the right-hand side
Open your exported data file (Excel or .csv)
Copy the relevant columns of data (e.g., time and )
Paste the data directly into the table in Vernier Graphical Analysis
Ensure the data are entered into the correct columns (e.g., x and y)
You should see a damped sinusoidal signal whose amplitude decreases over time now plotted.

 

Extract the Damping Coefficient and Frequency
Make sure you are in the Pro mode of Graphical Analysis before creating a custom fit
Custom Curve Fits is only available in the Pro mode of Graphical Analysis. If your copy of Graphical Analysis isn’t already upgraded, upgrade your copy to Pro.
Click the three dots in the top right corner of the program and click “About”
Enter the license key: gaTFp6hnZq
If prompted, DO NOT try to update the program.
Select and drag the relevant data you would like to fit in Graphical Analysis, or leave it unselected to use all the data
Select “Apply Curve Fit” from the menu that appears or by clicking on the graph symbol in the lower left corner.
Enter the model equation to try using mathematical notation.
For example y= would be entered as A*exp(x)+B*x-C*sin(x).
Note that your independent variable must be referred to as x in your equation.
Graphical Analysis will find the best values of each parameter (in this case A, B, & C) that fit your model to the data!
We can show the uncertainty in the fit parameters by clicking the gear that appears in the box. Very helpful!

 

Experimental Tip: Changing Surface Area While Keeping Mass Constant

If you are investigating the effect of surface area, try to change only the surface area while keeping the total mass of the pendulum approximately constant. One simple way to do this is:

Begin with your largest surface-area attachment (for example, a large piece of cardboard, cardstock, or foam board).
Perform one trial with this configuration.
For subsequent trials, trim the attachment to a smaller surface area.
Rather than throwing away the trimmed pieces, tape them securely to the phone or pendulum bob where they contribute very little additional air resistance (for example, folded flat against the back or sides of the phone). This keeps the total mass approximately constant while reducing the exposed surface area.

This approach helps ensure that changes in the damping are primarily due to surface area rather than differences in mass. (Note: The exact mass does not need to remain perfectly constant, but it should remain as similar as possible between trials.)

 

If you would like to practice entering the damped oscillator equation as a custom fit in Graphical Analysis, you can use the sample data set linked below.

lightly damped pendulum practice data.txt
Download lightly damped pendulum practice data.txt

This data set was collected from a lightly damped pendulum, so its amplitude decreases relatively slowly over time. Your experimental setups will likely exhibit stronger damping, meaning the amplitude will decrease more quickly than in this example.

Fitting parameters generated:

A: 0.1177 ± 0.0006321
B: 0.003679 ± 0.00033
C: 2.988 ± 0.0003761
D: 6.38 ± 0.006466
E: 4.707 ± 0.0002109
RMSE: 0.004892

.

## Links
- Vernier graphical analysis Pro versionLinks to an external site. -> https://graphicalanalysis.app/
- lightly damped pendulum practice data.txt -> https://canvas.oregonstate.edu/courses/2053526/files/119497374?wrap=1
- Download lightly damped pendulum practice data.txt -> https://canvas.oregonstate.edu/courses/2053526/files/119497374/download?download_frd=1

## Iframes
- Error -> about:blank
- post_message_forwarding -> https://sso.canvaslms.com/post_message_forwarding?rev=e6aca5e55d-9c856c93fa625037&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJwYXJlbnRfZG9tYWluIjoiY2FudmFzLm9yZWdvbnN0YXRlLmVkdSJ9.Y_7TbGBrESilECMiEp8IL9n-40gHDCjKBtRp1VeImmjwp-ey16yj9FLfLrLzGYInjx8U6Ow5IRBeWFd9i9f6Kg

## Buttons

## Hidden Text
- Links to an external site.
- Download lightly damped pendulum practice data.txt
